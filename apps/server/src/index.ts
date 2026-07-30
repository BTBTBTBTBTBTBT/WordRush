import { Server } from 'socket.io';
import { createServer } from 'http';
import { initDictionary, initDictionaryForLength, generateMatchSeed, generateSolutionsFromSeed, generateSolutionsFromSeedForLength, isValidWord, evaluateGuess, GameMode, GameStatus } from '@wordle-duel/core';
import { readFileSync } from 'fs';
import { join } from 'path';
import { MatchmakingQueue } from './matchmaking';
import { Match, Player, QueueEntry, ClientToServerEvents, ServerToClientEvents } from './types';

const allowedWords = JSON.parse(readFileSync(join(__dirname, '../../web/data/allowed.json'), 'utf-8'));
const solutionWords = JSON.parse(readFileSync(join(__dirname, '../../web/data/solutions.json'), 'utf-8'));
// Legacy list feeds the pre-cutover answer pool (date-gated in core). The
// server only creates non-daily (random/VS) matches, which always use the
// curated list, but core init requires legacy so pre-cutover seeds resolve.
const legacySolutionWords = JSON.parse(readFileSync(join(__dirname, '../../web/data/solutions-legacy.json'), 'utf-8'));
initDictionary(allowedWords, solutionWords, legacySolutionWords);
// 6/7-letter dictionaries for the Six/Seven duels (DUEL_6/DUEL_7 VS) — same
// files the web client loads in lib/init-dictionary.ts, so both sides resolve
// a match seed to the same word and validate guesses against the same list.
const allowed6Words = JSON.parse(readFileSync(join(__dirname, '../../web/data/allowed-6.json'), 'utf-8'));
const solution6Words = JSON.parse(readFileSync(join(__dirname, '../../web/data/solutions-6.json'), 'utf-8'));
const legacySolution6Words = JSON.parse(readFileSync(join(__dirname, '../../web/data/solutions-6-legacy.json'), 'utf-8'));
const allowed7Words = JSON.parse(readFileSync(join(__dirname, '../../web/data/allowed-7.json'), 'utf-8'));
const solution7Words = JSON.parse(readFileSync(join(__dirname, '../../web/data/solutions-7.json'), 'utf-8'));
const legacySolution7Words = JSON.parse(readFileSync(join(__dirname, '../../web/data/solutions-7-legacy.json'), 'utf-8'));
initDictionaryForLength(6, allowed6Words, solution6Words, legacySolution6Words);
initDictionaryForLength(7, allowed7Words, solution7Words, legacySolution7Words);

// ProperNoundle puzzle data
interface ProperNoundlePuzzle {
  id: string;
  answer: string;
  display: string;
  category: string;
  themeCategory: string;
}
let properNoundlePuzzles: ProperNoundlePuzzle[] = [];
try {
  properNoundlePuzzles = JSON.parse(readFileSync(join(__dirname, '../../web/data/propernoundle-puzzles.json'), 'utf-8'));
} catch {
  console.warn('ProperNoundle puzzles not found, VS mode for ProperNoundle will not work');
}

function selectProperNoundlePuzzle(seed: string): ProperNoundlePuzzle {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % properNoundlePuzzles.length;
  return properNoundlePuzzles[index];
}

const MODE_BOARD_COUNT: Record<string, number> = {
  [GameMode.DUEL]: 1,
  [GameMode.QUORDLE]: 4,
  [GameMode.OCTORDLE]: 8,
  [GameMode.SEQUENCE]: 4,
  [GameMode.RESCUE]: 4,
  [GameMode.GAUNTLET]: 21,
  [GameMode.MULTI_DUEL]: 2,
  [GameMode.TOURNAMENT]: 1,
  [GameMode.PROPERNOUNDLE]: 1,
  [GameMode.DUEL_6]: 1,
  [GameMode.DUEL_7]: 1
};

// Modes where one guess applies to ALL boards at once (not one active board).
// For these we fan the guess out against every still-unsolved board so the
// opponent's per-board mini-boards all populate — not just board 0. Sequence is
// NOT here (it's one active board at a time); Gauntlet is NOT here (its opponent
// view is a stage tracker, and its board count spans all 21 stage boards).
const APPLY_TO_ALL_MODES = new Set<string>([GameMode.QUORDLE, GameMode.OCTORDLE, GameMode.RESCUE]);

const MODE_MAX_GUESSES: Record<string, number> = {
  [GameMode.DUEL]: 6,
  [GameMode.QUORDLE]: 9,
  [GameMode.OCTORDLE]: 13,
  [GameMode.SEQUENCE]: 10,
  [GameMode.RESCUE]: 6,
  [GameMode.GAUNTLET]: 50,
  [GameMode.MULTI_DUEL]: 6,
  [GameMode.TOURNAMENT]: 6,
  [GameMode.PROPERNOUNDLE]: 6,
  [GameMode.DUEL_6]: 7,
  [GameMode.DUEL_7]: 8
};

// Word length per mode — 5 everywhere except the Six/Seven duels.
// ProperNoundle is variable-length and skips length validation entirely.
// Mirrors MODE_WORD_LEN in apps/web/components/vs/vs-game.tsx and the
// DUEL_6/DUEL_7 branches of the core reducer.
const MODE_WORD_LENGTH: Record<string, number> = {
  [GameMode.DUEL_6]: 6,
  [GameMode.DUEL_7]: 7
};

/** Length-aware solution derivation — the Six/Seven duels draw from their own
 *  curated pools via generateSolutionsFromSeedForLength, exactly as clients do
 *  (core reducer / vs-game), so both sides resolve the same seed to the same
 *  word. Everything else keeps the 5-letter generator. */
function generateSolutionsForMode(mode: GameMode, seed: string, boardCount: number): string[] {
  const wordLength = MODE_WORD_LENGTH[mode] || 5;
  return wordLength === 5
    ? generateSolutionsFromSeed(seed, boardCount)
    : generateSolutionsFromSeedForLength(seed, boardCount, wordLength);
}

// Socket.IO accepts a string, a string[], or a function for `cors.origin`.
// Parse CLIENT_URL as a comma-separated list so a single env var can cover
// both the new wordocious.com canonical domain and the legacy
// spellstrike.vercel.app subdomain during the rebrand transition.
// Example CLIENT_URL: "https://wordocious.com,https://spellstrike.vercel.app"
const clientOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const httpServer = createServer();

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: clientOrigins.length === 1 ? clientOrigins[0] : clientOrigins,
    methods: ['GET', 'POST']
  }
});

// Lightweight presence endpoint — home screen polls this to render the
// "N players online" count next to the LIVE pulse. Dedupes by the
// `presenceId` each client sends in its handshake auth payload so a
// single person with multiple sockets (e.g. the SitePresenceProvider's
// idle socket + their in-match Socket.IO connection) counts as 1, not 2.
// Signed-in users send `u:<supabase-user-id>` (dedupes across tabs AND
// devices); anonymous visitors send `a:<per-browser-UUID>` (dedupes
// across tabs in the same browser profile). Sockets that arrive without
// a presenceId fall back to their socket.id, so they're counted but not
// collapsed — matches pre-dedupe behaviour for any out-of-date clients.
httpServer.on('request', (req, res) => {
  if (!req.url) return;
  if (req.url.startsWith('/socket.io/')) return; // let Socket.IO handle it
  if (req.url.startsWith('/presence')) {
    const origin = req.headers.origin ?? '';
    const allowed = clientOrigins.includes(origin) ? origin : clientOrigins[0] ?? '*';
    const uniquePresence = new Set<string>();
    io.sockets.sockets.forEach((sock) => {
      const id = (sock.data as { presenceId?: string }).presenceId ?? sock.id;
      uniquePresence.add(id);
    });
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowed,
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify({ online: uniquePresence.size }));
    return;
  }
  // Deployed-build marker so we can confirm from outside WHICH commit Railway
  // is running (Railway injects RAILWAY_GIT_COMMIT_SHA at build time).
  if (req.url.startsWith('/version')) {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({
      commit: process.env.RAILWAY_GIT_COMMIT_SHA ?? null,
      branch: process.env.RAILWAY_GIT_BRANCH ?? null,
      deployedAt: process.env.RAILWAY_DEPLOYMENT_ID ?? null,
    }));
    return;
  }
  // TEMP diagnostic — live queue/connection snapshot (VS pairing debug 2026-06-18).
  if (req.url.startsWith('/debug/queue')) {
    const sockets: { id: string; presence: string | null }[] = [];
    io.sockets.sockets.forEach((sock) => {
      sockets.push({ id: sock.id, presence: (sock.data as { presenceId?: string }).presenceId ?? null });
    });
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({
      now: Date.now(),
      connectedSockets: sockets,
      queue: queue.snapshot(),
      privateLobbies: [...privateLobbies.keys()],
      activeMatches: matches.size,
    }, null, 2));
    return;
  }
  // Live VS activity per mode — players WAITING in queue + players PLAYING an
  // active match, so the lobby can show "N waiting · M playing" on each mode row.
  if (req.url.startsWith('/vs/counts')) {
    const origin = req.headers.origin ?? '';
    const allowed = clientOrigins.includes(origin) ? origin : clientOrigins[0] ?? '*';
    const waiting: Record<string, number> = {};
    for (const [k, arr] of Object.entries(queue.snapshot())) {
      const mode = k.split(':')[0]; // bucket key is `${mode}:${dailySeed|random}`
      waiting[mode] = (waiting[mode] ?? 0) + arr.length;
    }
    const playing: Record<string, number> = {};
    // Skip ended matches — they linger only for a possible rematch and used
    // to inflate "M playing" until a socket dropped.
    for (const m of matches.values()) { if (!m.ended) playing[m.mode] = (playing[m.mode] ?? 0) + 2; } // 2 players/match
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowed,
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify({ waiting, playing }));
    return;
  }
  // TEMP diagnostic — recent VS match-event log (Sequence/Succession relay debug
  // 2026-06-30). Ring buffer of the last 300 events so we can see exactly which
  // submit_guess / board_solved / player_completed events reach the server.
  if (req.url.startsWith('/debug/vslog')) {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ now: Date.now(), count: vsLog.length, events: vsLog }, null, 2));
    return;
  }
  // Unknown path — 404 cleanly rather than hanging.
  res.writeHead(404);
  res.end();
});

const queue = new MatchmakingQueue();
const matches = new Map<string, Match>();
const playerToMatch = new Map<string, string>();
// Monotonic counter so two matches created in the same millisecond can't
// collide on a Date.now()-only id (second pair silently overwrote the first).
let matchSeq = 0;
const nextMatchId = () => `match-${Date.now()}-${++matchSeq}`;
// How long a finished match is kept around for a possible rematch before the
// sweep deletes it (rematch/decline/disconnect all clean up sooner themselves).
const ENDED_MATCH_TTL_MS = 5 * 60 * 1000;
// Hard caps so a stalled or hostile client can't pin a match open forever:
// every match resolves by current standing at most 10 minutes after its
// start, and once the FIRST player finishes the other has 3 minutes to wrap
// up. Both fire the normal match_ended flow (see timeoutMatch).
const MATCH_MAX_DURATION_MS = 10 * 60 * 1000;
const FINISH_TIMEOUT_MS = 3 * 60 * 1000;

/** Delete a match and every lookup keyed to it. */
function cleanupMatch(matchId: string): void {
  const m = matches.get(matchId);
  if (m) {
    if (m.rematchTimer) clearTimeout(m.rematchTimer);
    if (m.capTimer) clearTimeout(m.capTimer);
    if (m.finishTimer) clearTimeout(m.finishTimer);
    if (m.resumePending) { for (const t of m.resumePending.values()) clearTimeout(t); m.resumePending.clear(); }
    if (playerToMatch.get(m.player1.id) === matchId) playerToMatch.delete(m.player1.id);
    if (playerToMatch.get(m.player2.id) === matchId) playerToMatch.delete(m.player2.id);
  }
  matches.delete(matchId);
  submittedWordsByMatch.delete(matchId);
  guessLogByMatch.delete(matchId);
}
// Per-player guess history within an active match. Keyed by matchId so
// it clears naturally on match end. Used to reject duplicate guesses
// server-side even if a modified client bypasses its local check.
const submittedWordsByMatch = new Map<string, { p1: Set<string>; p2: Set<string> }>();
// Ordered per-player guess log (word + board) — revealed to the OPPONENT only
// at match end so the result screen can show both final boards with letters.
const guessLogByMatch = new Map<string, { p1: { boardIndex: number; guess: string }[]; p2: { boardIndex: number; guess: string }[] }>();

// TEMP diagnostic ring buffer (Sequence/Succession VS relay debug 2026-06-30).
// Records the last 300 VS match events so /debug/vslog can show exactly which
// submit_guess / board_solved / player_completed events the server received.
const vsLog: { t: number; ev: string; who: string | null; detail: Record<string, unknown> }[] = [];
function logVS(ev: string, who: string | null, detail: Record<string, unknown>): void {
  vsLog.push({ t: Date.now(), ev, who, detail });
  if (vsLog.length > 300) vsLog.splice(0, vsLog.length - 300);
}
// Private-match lobbies keyed by invite_code. First arrival is parked
// here; the second arrival with the same code pairs up with them
// immediately, bypassing the public matchmaking queue.
// `presence` is the parker's stable per-user id (`u:<userId>`) from the
// handshake. We dedupe lobbies by it — NOT by the per-socket playerId, which
// changes on every reconnect — so a creator who reconnects (e.g. the iOS share
// sheet briefly backgrounds the app) recognizes its OWN parked lobby instead of
// pairing against itself.
const privateLobbies = new Map<string, { entry: QueueEntry; expiresAt: number; presence?: string }>();
const PRIVATE_LOBBY_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MATCH_COUNTDOWN = 3;
const REMATCH_TIMEOUT = 30000;

// Reconnect grace: a mid-match disconnect (phone call, notification, screen
// lock — anything that backgrounds the app and drops the socket) does NOT
// instantly forfeit. We hold the match open for this window and, if the same
// signed-in player reconnects (same presence id in the handshake), re-bind their
// new socket and resume. Only when the window expires does it become a forfeit.
const RECONNECT_GRACE_MS = 60000;
// Keyed by the stable presence id (`u:<userId>`) of a player who dropped
// mid-match. Holds the match + the pending forfeit timer so a reconnect can
// re-attach. `deadline` is the absolute grace expiry: a rebind does NOT
// disarm the forfeit, it re-arms it against this same deadline until the
// rebound socket proves itself with an in-match event (see confirmResume).
// Anonymous players (no presence id) skip the grace and forfeit immediately,
// as before.
const pendingReconnects = new Map<string, { matchId: string; oldPlayerId: string; timer: ReturnType<typeof setTimeout>; deadline: number }>();

io.on('connection', (socket) => {
  // Stash the presenceId from the handshake so /presence can dedupe
  // distinct sockets belonging to the same person. Not required — clients
  // that don't send one just fall through to socket.id on the /presence
  // side, which preserves the pre-dedupe count for those sockets.
  const presenceId = (socket.handshake.auth as { presenceId?: string } | undefined)?.presenceId;
  if (presenceId) (socket.data as { presenceId?: string }).presenceId = presenceId;

  console.log(`Client connected: ${socket.id}${presenceId ? ` (presence=${presenceId})` : ''}`);

  const playerId = socket.id;
  const player: Player = {
    id: playerId,
    socketId: socket.id,
    rating: 1000,
    // Stable per-person id — matchmaking uses it so two sockets belonging to
    // the same person (two tabs, or a reconnect's ghost entry) never pair.
    presence: presenceId
  };

  // Reconnect-into-match: if this signed-in player dropped mid-match within the
  // grace window, re-bind their NEW socket to the existing match and resume —
  // instead of leaving the match stranded (and them forfeited). Socket.IO auto-
  // reconnects with the same presence id in the handshake, so this fires
  // automatically when the app returns to the foreground.
  if (presenceId && pendingReconnects.has(presenceId)) {
    const pending = pendingReconnects.get(presenceId)!;
    clearTimeout(pending.timer);
    pendingReconnects.delete(presenceId);
    const match = matches.get(pending.matchId);
    if (match) {
      const isP1 = match.player1.id === pending.oldPlayerId;
      const slot = isP1 ? match.player1 : match.player2;
      // Re-point the match's player slot at the new socket, and re-key the
      // playerId→match lookup so this socket's guesses resolve to the match.
      playerToMatch.delete(pending.oldPlayerId);
      slot.id = playerId;
      slot.socketId = socket.id;
      playerToMatch.set(playerId, pending.matchId);
      logVS('reconnect', presenceId, { mode: match.mode, matchId: pending.matchId });
      // The rebind alone does NOT prove the player is back: every platform
      // also runs an always-on presence socket with this same `u:<userId>`
      // handshake id, and if THAT socket claims the slot it has no match
      // handlers — the opponent would hang forever. Keep the forfeit armed
      // against the ORIGINAL grace deadline; the rebound socket's first
      // in-match event (confirmResume) is what disarms it and tells the
      // opponent they're back. A presence-socket claim just lets the forfeit
      // fire at grace expiry, exactly as if no one had reconnected.
      const remaining = Math.max(0, pending.deadline - Date.now());
      const resumeTimer = setTimeout(() => {
        const m = matches.get(pending.matchId);
        if (!m) return;
        m.resumePending?.delete(playerId);
        const stillP1 = m.player1.id === playerId;
        const pState = stillP1 ? m.player1State : m.player2State;
        const oState = stillP1 ? m.player2State : m.player1State;
        if (pState.status === GameStatus.PLAYING || oState.status === GameStatus.PLAYING) {
          pState.status = GameStatus.ABANDONED;
          pState.completedAt = pState.completedAt ?? Date.now();
          logVS('resume_grace_expired', presenceId, { mode: m.mode, matchId: pending.matchId });
          io.to(stillP1 ? m.player2.socketId : m.player1.socketId).emit('opponent_left');
          endMatch(pending.matchId, playerId);
        }
        cleanupMatch(pending.matchId);
      }, remaining);
      (match.resumePending ??= new Map()).set(playerId, resumeTimer);
      socket.emit('match_resumed', { matchId: pending.matchId });
    }
  }

  socket.on('join_queue', ({ mode, dailySeed, inviteCode }) => {
    queue.removeFromQueue(playerId);

    // Private match via invite: pair the two clients who arrive with the
    // same invite_code regardless of the public queue.
    if (inviteCode) {
      // Purge any stale lobby the caller may have previously parked — match by
      // the STABLE presence id too, so a reconnect (new socket.id → new
      // playerId) still clears its own old lobby instead of leaving a ghost it
      // can then pair against.
      for (const [code, lobby] of privateLobbies) {
        const sameUser = presenceId != null && lobby.presence === presenceId;
        if (lobby.entry.player.id === playerId || sameUser) privateLobbies.delete(code);
        else if (lobby.expiresAt < Date.now()) privateLobbies.delete(code);
      }

      const existing = privateLobbies.get(inviteCode);
      // Self-match guard: never pair a lobby with the same socket OR the same
      // signed-in user. Before the presence check, a creator whose socket
      // reconnected joined its own code under a new playerId and got matched
      // against itself the instant it shared the code.
      const isSelf = existing != null && (
        existing.entry.player.id === playerId ||
        (presenceId != null && existing.presence === presenceId)
      );
      if (existing && !isSelf) {
        privateLobbies.delete(inviteCode);
        const preferredSeed = existing.entry.dailySeed || dailySeed;
        // Mode comes from the lobby CREATOR's parked entry, not the joiner's
        // payload — a doctored/mismatched invite URL used to make the server
        // adopt the second arrival's mode and desync the two clients.
        createMatch(existing.entry.player, player, existing.entry.mode, preferredSeed);
      } else {
        privateLobbies.set(inviteCode, {
          entry: { player, mode, joinedAt: Date.now(), dailySeed, inviteCode },
          expiresAt: Date.now() + PRIVATE_LOBBY_TTL_MS,
          presence: presenceId,
        });
        socket.emit('queue_status', { position: 0, mode });
      }
      return;
    }

    const position = queue.addToQueue(player, mode, dailySeed);
    console.log(`[queue] join mode=${mode} seed=${dailySeed ?? 'random'} pos=${position} presence=${presenceId ?? socket.id} size=${queue.getQueueSize(mode, dailySeed)}`);

    socket.emit('queue_status', { position, mode, queueSize: queue.getQueueSize(mode, dailySeed), dailySeed: dailySeed ?? null });

    // Bucketed by (mode, dailySeed-or-random): daily players only pair with
    // daily players on the same seed; random with random.
    const matchPair = queue.findMatch(mode, dailySeed);
    if (matchPair) {
      const [entry1, entry2] = matchPair;
      const preferredSeed = entry1.dailySeed || entry2.dailySeed;
      console.log(`[queue] paired mode=${mode} seed=${preferredSeed ?? 'random'} p1=${entry1.player.id} p2=${entry2.player.id}`);
      createMatch(entry1.player, entry2.player, mode, preferredSeed);
    }
  });

  // Lightweight "opponent is typing" relay — clients send a throttled ping
  // while the local player has letters in the current row; we forward it so
  // the opponent's UI can show a live activity indicator. No letters leak.
  socket.on('typing', () => {
    const matchId = playerToMatch.get(playerId);
    if (!matchId) return;
    const match = matches.get(matchId);
    if (!match) return;
    confirmResume(match, playerId);
    const opponentSocket = match.player1.id === playerId ? match.player2.socketId : match.player1.socketId;
    io.to(opponentSocket).emit('opponent_typing', {});
  });

  socket.on('leave_queue', () => {
    queue.removeFromQueue(playerId);
    // Also release any private lobby this player is parked in.
    for (const [code, lobby] of privateLobbies) {
      if (lobby.entry.player.id === playerId) privateLobbies.delete(code);
    }
  });

  socket.on('submit_guess', ({ guess, boardIndex = 0 }) => {
    const matchId = playerToMatch.get(playerId);
    if (!matchId) {
      logVS('submit_guess_REJECT', presenceId ?? socket.id, { guess, reason: 'not in a match' });
      socket.emit('error', { message: 'Not in a match' });
      return;
    }

    const match = matches.get(matchId);
    if (!match) {
      logVS('submit_guess_REJECT', presenceId ?? socket.id, { guess, reason: 'match not found' });
      socket.emit('error', { message: 'Match not found' });
      return;
    }

    confirmResume(match, playerId);

    // The match has a server-authoritative start time with a countdown in front
    // of it. Nothing should reach the board before that instant: a modified
    // client could otherwise bank guesses during the countdown and — because
    // endMatch times players as `completedAt - serverStartAt` — finish with a
    // NEGATIVE duration, which sorts ahead of every honest result. Real clients
    // don't accept input until match_start, so this only ever rejects abuse.
    if (Date.now() < match.serverStartAt) {
      logVS('submit_guess_REJECT', presenceId ?? socket.id, { guess, reason: 'before match start' });
      socket.emit('guess_result', {
        boardIndex, isValid: false, isCorrect: false, reason: 'Match has not started',
      });
      return;
    }

    // boardIndex arrives from the client and indexes match.solutions directly.
    // Out of range made `solution` undefined and the .toUpperCase() below threw
    // inside the handler — one crafted packet could take the process down and
    // with it EVERY live match. Validate before it is used as an index.
    if (!Number.isInteger(boardIndex) || boardIndex < 0 || boardIndex >= match.solutions.length) {
      logVS('submit_guess_REJECT', presenceId ?? socket.id, { guess, reason: 'boardIndex out of range', boardIndex });
      socket.emit('guess_result', {
        boardIndex: 0, isValid: false, isCorrect: false, reason: 'Invalid board',
      });
      return;
    }

    // Skip length and dictionary checks for ProperNoundle (variable-length proper nouns)
    if (match.mode !== GameMode.PROPERNOUNDLE) {
      const wordLength = MODE_WORD_LENGTH[match.mode] || 5;
      if (guess.length !== wordLength) {
        socket.emit('guess_result', {
          boardIndex,
          isValid: false,
          isCorrect: false,
          reason: `Guess must be ${wordLength} letters`
        });
        return;
      }

      if (!isValidWord(guess)) {
        socket.emit('guess_result', {
          boardIndex,
          isValid: false,
          isCorrect: false,
          reason: 'Not in word list'
        });
        return;
      }
    }

    const isPlayer1 = match.player1.id === playerId;
    // Dedupe key is case-insensitive and ignores surrounding whitespace.
    // ProperNoundle's evaluation-time normalization (see `normalizedGuess`
    // below) strips non-alpha and lowercases, but uppercase is sufficient
    // for dedupe purposes since equality is symmetric under case folding.
    const dedupeKey = guess.toUpperCase();
    const history = submittedWordsByMatch.get(matchId);
    const playerHistory = history ? (isPlayer1 ? history.p1 : history.p2) : null;
    if (playerHistory?.has(dedupeKey)) {
      logVS('submit_guess_REJECT', presenceId ?? socket.id, { guess, reason: 'already guessed' });
      socket.emit('guess_result', {
        boardIndex,
        isValid: false,
        isCorrect: false,
        reason: 'Already guessed'
      });
      return;
    }
    playerHistory?.add(dedupeKey);
    const log = guessLogByMatch.get(matchId);
    if (log) (isPlayer1 ? log.p1 : log.p2).push({ boardIndex, guess: guess.toUpperCase() });

    const playerState = isPlayer1 ? match.player1State : match.player2State;
    const opponentState = isPlayer1 ? match.player2State : match.player1State;
    const opponentSocket = isPlayer1 ? match.player2.socketId : match.player1.socketId;

    if (playerState.status !== GameStatus.PLAYING) {
      logVS('submit_guess_REJECT', presenceId ?? socket.id, { guess, reason: 'game already completed', status: playerState.status });
      socket.emit('error', { message: 'Game already completed' });
      return;
    }

    const solution = match.solutions[boardIndex];
    const normalizedGuess = match.mode === GameMode.PROPERNOUNDLE
      ? guess.toLowerCase().replace(/[^a-z]/g, '')
      : guess.toUpperCase();
    const normalizedSolution = match.mode === GameMode.PROPERNOUNDLE
      ? solution.toLowerCase().replace(/[^a-z]/g, '')
      : solution.toUpperCase();
    const isCorrect = normalizedGuess === normalizedSolution;

    playerState.guesses++;
    logVS('submit_guess', presenceId ?? socket.id, {
      mode: match.mode, guess, boardIndex, isCorrect,
      guesses: playerState.guesses, status: playerState.status,
    });

    socket.emit('guess_result', {
      boardIndex,
      isValid: true,
      isCorrect
    });

    const maxGuesses = MODE_MAX_GUESSES[match.mode] || 6;

    if (isCorrect) {
      // Server-verified solve for the submitted board (ground truth for the
      // player_completed won-claim check below).
      (playerState.serverSolvedSet ??= new Set<number>()).add(boardIndex);
      // For single-board modes, mark done
      if (MODE_BOARD_COUNT[match.mode] === 1) {
        playerState.status = GameStatus.WON;
        playerState.completedAt = Date.now();
      }
    } else if (playerState.guesses >= maxGuesses) {
      playerState.status = GameStatus.LOST;
      playerState.completedAt = Date.now();
    }

    // Evaluate tiles for opponent visualization (colors only, no letters)
    let latestGuess: { boardIndex: number; tiles: string[] } | undefined;
    try {
      const evalResult = evaluateGuess(normalizedSolution, normalizedGuess);
      latestGuess = {
        boardIndex,
        tiles: evalResult.tiles.map((t: any) => t.state),
      };
    } catch (e) {
      // ProperNoundle or variable-length words may fail evaluation
    }

    // applyToAll modes (quordle/octordle/rescue): the one guess hit EVERY board,
    // so evaluate it against each still-unsolved board and send them all — the
    // opponent's per-board mini-boards populate, not just board 0. Solved boards
    // are skipped (their winning row already showed via the board_solved guess).
    let latestGuesses: { boardIndex: number; tiles: string[] }[] | undefined;
    if (APPLY_TO_ALL_MODES.has(match.mode)) {
      const solved = playerState.solvedBoardSet;
      latestGuesses = [];
      for (let i = 0; i < match.solutions.length; i++) {
        if (solved?.has(i)) continue;
        try {
          const ev = evaluateGuess(match.solutions[i].toUpperCase(), normalizedGuess);
          latestGuesses.push({ boardIndex: i, tiles: ev.tiles.map((t: any) => t.state) });
          // applyToAll: the one guess hit every board — record any it solved.
          if (normalizedGuess === match.solutions[i].toUpperCase()) {
            (playerState.serverSolvedSet ??= new Set<number>()).add(i);
          }
        } catch { /* skip unevaluable board */ }
      }
    }

    io.to(opponentSocket).emit('opponent_progress', {
      attempts: playerState.guesses,
      solved: playerState.status === GameStatus.WON,
      boardsSolved: playerState.boardsSolved,
      totalBoards: playerState.totalBoards,
      ...(latestGuess ? { latestGuess } : {}),
      ...(latestGuesses && latestGuesses.length ? { latestGuesses } : {}),
    });

    if (playerState.status !== GameStatus.PLAYING && opponentState.status !== GameStatus.PLAYING) {
      endMatch(matchId);
    } else if (playerState.status !== GameStatus.PLAYING) {
      // First finisher (server-detected): the opponent is now on the clock.
      armFinishTimeout(matchId);
    }
  });

  socket.on('board_solved', ({ boardIndex }) => {
    const matchId = playerToMatch.get(playerId);
    if (!matchId) return;

    const match = matches.get(matchId);
    if (!match) return;

    confirmResume(match, playerId);

    const isPlayer1 = match.player1.id === playerId;
    const playerState = isPlayer1 ? match.player1State : match.player2State;
    const opponentSocket = isPlayer1 ? match.player2.socketId : match.player1.socketId;

    // The client names which board it solved, so this is only trustworthy once
    // the index is real AND not already counted. Unvalidated, `boardsSolved++`
    // could be spammed past totalBoards — and multi-board modes decide the
    // winner from that count, so a client could simply declare victory.
    const solvedSet = (playerState.solvedBoardSet ??= new Set<number>());
    if (!Number.isInteger(boardIndex) || boardIndex < 0 || boardIndex >= playerState.totalBoards) {
      logVS('board_solved_REJECT', presenceId ?? socket.id, { boardIndex, reason: 'out of range' });
      return;
    }
    if (solvedSet.has(boardIndex)) {
      logVS('board_solved_REJECT', presenceId ?? socket.id, { boardIndex, reason: 'already counted' });
      return;
    }
    solvedSet.add(boardIndex);
    playerState.boardsSolved = solvedSet.size;
    logVS('board_solved', presenceId ?? socket.id, {
      mode: match.mode, boardIndex, boardsSolved: playerState.boardsSolved, totalBoards: playerState.totalBoards,
    });

    io.to(opponentSocket).emit('opponent_progress', {
      attempts: playerState.guesses,
      solved: playerState.boardsSolved >= playerState.totalBoards,
      boardsSolved: playerState.boardsSolved,
      totalBoards: playerState.totalBoards
    });
  });

  socket.on('player_completed', ({ status, totalGuesses, timeMs }) => {
    const matchId = playerToMatch.get(playerId);
    if (!matchId) { logVS('player_completed_DROP', presenceId ?? socket.id, { status, reason: 'no matchId mapping' }); return; }

    const match = matches.get(matchId);
    if (!match) { logVS('player_completed_DROP', presenceId ?? socket.id, { status, reason: 'match not found' }); return; }

    confirmResume(match, playerId);

    const isPlayer1 = match.player1.id === playerId;
    const playerState = isPlayer1 ? match.player1State : match.player2State;
    const opponentState = isPlayer1 ? match.player2State : match.player1State;

    // Validate a "won" claim against the server's OWN evaluations — a modified
    // client could otherwise claim an instant win without ever guessing right.
    // Single-board: the server already marked WON on the correct guess.
    // applyToAll multi-board + Sequence: every board's solution must have been
    // seen correct by the server (serverSolvedSet, filled in submit_guess).
    // Gauntlet is excluded (its 21 board indices are stage-relative, so the
    // set can't be compared to a flat board count).
    let claimedWon = status === 'won';
    if (claimedWon && match.mode !== GameMode.GAUNTLET) {
      const boardCount = MODE_BOARD_COUNT[match.mode] || 1;
      const verified = boardCount === 1
        ? playerState.status === GameStatus.WON
        : (playerState.serverSolvedSet?.size ?? 0) >= boardCount;
      if (!verified) {
        logVS('player_completed_WON_REJECTED', presenceId ?? socket.id, {
          mode: match.mode, serverSolved: playerState.serverSolvedSet?.size ?? 0,
        });
        claimedWon = false;
      }
    }

    playerState.status = claimedWon ? GameStatus.WON : GameStatus.LOST;
    playerState.completedAt = Date.now();
    // The client's totalGuesses is deliberately IGNORED (logged only) —
    // playerState.guesses is the server's own count from submit_guess, and the
    // tie-break scores in endMatch must not be spoofable by a doctored payload.
    logVS('player_completed', presenceId ?? socket.id, {
      mode: match.mode, status, totalGuesses, serverGuesses: playerState.guesses,
      opponentStatus: opponentState.status,
      willEnd: opponentState.status !== GameStatus.PLAYING,
    });

    // Both players must be done (playerState was just set to WON/LOST above)
    if (opponentState.status !== GameStatus.PLAYING) {
      endMatch(matchId);
    } else {
      // First finisher: the opponent is now on the FINISH_TIMEOUT_MS clock.
      armFinishTimeout(matchId);
    }
  });

  socket.on('stage_completed', ({ stageIndex }) => {
    const matchId = playerToMatch.get(playerId);
    if (!matchId) return;

    const match = matches.get(matchId);
    if (!match) return;

    confirmResume(match, playerId);

    const isPlayer1 = match.player1.id === playerId;
    const playerState = isPlayer1 ? match.player1State : match.player2State;
    const opponentSocket = isPlayer1 ? match.player2.socketId : match.player1.socketId;

    playerState.currentStage = stageIndex;

    // Gauntlet: each stage is a fresh board set, so a word from an earlier
    // stage is a LEGAL guess again (clients only dedupe within the stage).
    // The per-match dedupe set used to reject it — and if a later stage's
    // solution had been guessed in an earlier stage, that board became
    // unwinnable. Reset this player's dedupe history at each stage boundary.
    const history = submittedWordsByMatch.get(matchId);
    if (history) (isPlayer1 ? history.p1 : history.p2).clear();

    io.to(opponentSocket).emit('opponent_stage_completed', { stageIndex });
  });

  socket.on('abandon_match', () => {
    const matchId = playerToMatch.get(playerId);
    if (!matchId) return;

    const match = matches.get(matchId);
    if (!match) return;

    const isPlayer1 = match.player1.id === playerId;
    const playerState = isPlayer1 ? match.player1State : match.player2State;

    playerState.status = GameStatus.ABANDONED;
    playerState.completedAt = Date.now();
    logVS('abandon_match', presenceId ?? socket.id, { mode: match.mode });

    // Explicit leave — tell the remaining player before the match_ended flow
    // so their (previously dead-code) opponent_left handlers light up.
    io.to(isPlayer1 ? match.player2.socketId : match.player1.socketId).emit('opponent_left');

    // Pass forfeitBy so the REMAINING player is credited the win. Without it,
    // endMatch derives the winner purely from board state — and since the
    // abandoner is ABANDONED (not WON) and the opponent is still PLAYING (not
    // WON), no win condition matches and winner stays null, so BOTH players
    // recorded a loss. Mirrors the disconnect handler's endMatch(matchId, playerId).
    endMatch(matchId, playerId);
  });

  socket.on('offer_rematch', () => {
    const matchId = playerToMatch.get(playerId);
    // The match may already be gone (opponent left and it was cleaned up, or
    // the TTL sweep ran) — bounce a decline straight back so the offerer's
    // button resolves instead of hanging on "Waiting…".
    if (!matchId) {
      socket.emit('rematch_declined');
      return;
    }
    const match = matches.get(matchId);
    if (!match) {
      socket.emit('rematch_declined');
      return;
    }

    confirmResume(match, playerId);
    match.rematchOffers.add(playerId);

    const isPlayer1 = match.player1.id === playerId;
    const opponentSocket = isPlayer1 ? match.player2.socketId : match.player1.socketId;

    io.to(opponentSocket).emit('rematch_offered');

    // First offer arms the (previously dead-code) REMATCH_TIMEOUT: if the
    // opponent never answers within the window, tell the offerer it's off —
    // their "Waiting…" state used to hang forever. Reuses rematch_declined so
    // every existing client handles it with zero changes.
    if (match.rematchOffers.size === 1 && !match.rematchTimer) {
      match.rematchTimer = setTimeout(() => {
        const m = matches.get(matchId);
        if (!m || m.rematchOffers.size === 2) return;
        for (const offererId of m.rematchOffers) {
          const offererSocket = m.player1.id === offererId ? m.player1.socketId : m.player2.socketId;
          io.to(offererSocket).emit('rematch_declined');
        }
        logVS('rematch_timeout', null, { mode: m.mode, matchId });
        cleanupMatch(matchId);
      }, REMATCH_TIMEOUT);
    }

    if (match.rematchOffers.size === 2) {
      if (match.rematchTimer) { clearTimeout(match.rematchTimer); match.rematchTimer = undefined; }
      const newMatchId = nextMatchId();
      const newSeed = generateMatchSeed();
      const boardCount = MODE_BOARD_COUNT[match.mode] || 1;

      let newSolutions: string[];
      let newPuzzleMetadata: any;
      if (match.mode === GameMode.PROPERNOUNDLE && properNoundlePuzzles.length > 0) {
        const puzzle = selectProperNoundlePuzzle(newSeed);
        newSolutions = [puzzle.answer];
        newPuzzleMetadata = { display: puzzle.display, category: puzzle.category, answerLength: puzzle.answer.length, themeCategory: puzzle.themeCategory };
      } else {
        newSolutions = generateSolutionsForMode(match.mode, newSeed, boardCount);
      }

      const newServerStartAt = Date.now() + MATCH_COUNTDOWN * 1000;
      const newMatch: Match = {
        id: newMatchId,
        mode: match.mode,
        seed: newSeed,
        player1: match.player1,
        player2: match.player2,
        // Same two people — carry the identities resolved at the original
        // createMatch over so a forfeit here still reports opponentId.
        player1UserId: match.player1UserId,
        player2UserId: match.player2UserId,
        solutions: newSolutions,
        serverStartAt: newServerStartAt,
        player1State: { guesses: 0, status: GameStatus.PLAYING, boardsSolved: 0, totalBoards: boardCount },
        player2State: { guesses: 0, status: GameStatus.PLAYING, boardsSolved: 0, totalBoards: boardCount },
        rematchOffers: new Set()
      };
      // Rematches get the same hard cap as first matches.
      newMatch.capTimer = setTimeout(() => timeoutMatch(newMatchId), (newServerStartAt - Date.now()) + MATCH_MAX_DURATION_MS);

      matches.set(newMatchId, newMatch);
      playerToMatch.set(match.player1.id, newMatchId);
      playerToMatch.set(match.player2.id, newMatchId);
      matches.delete(matchId);
      submittedWordsByMatch.delete(matchId);
      submittedWordsByMatch.set(newMatchId, { p1: new Set(), p2: new Set() });
      // Seed a fresh guess log for the rematch — createMatch does this, but the
      // rematch path didn't, so guessLogByMatch.get(newMatchId) was undefined and
      // submit_guess silently skipped logging → both result screens showed
      // "No guesses" for the opponent. Clean up the old match's log too.
      guessLogByMatch.delete(matchId);
      guessLogByMatch.set(newMatchId, { p1: [], p2: [] });

      io.to(match.player1.socketId).emit('rematch_start', { matchId: newMatchId, seed: newSeed, puzzleMetadata: newPuzzleMetadata });
      io.to(match.player2.socketId).emit('rematch_start', { matchId: newMatchId, seed: newSeed, puzzleMetadata: newPuzzleMetadata });
    }
  });

  socket.on('decline_rematch', () => {
    const matchId = playerToMatch.get(playerId);
    if (!matchId) return;

    const match = matches.get(matchId);
    if (!match) return;

    confirmResume(match, playerId);

    const isPlayer1 = match.player1.id === playerId;
    const opponentSocket = isPlayer1 ? match.player2.socketId : match.player1.socketId;

    io.to(opponentSocket).emit('rematch_declined');

    cleanupMatch(matchId);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);

    queue.removeFromQueue(playerId);
    for (const [code, lobby] of privateLobbies) {
      if (lobby.entry.player.id === playerId) privateLobbies.delete(code);
    }

    const matchId = playerToMatch.get(playerId);
    if (matchId) {
      const match = matches.get(matchId);
      if (match) {
        // If this socket was a rebound-but-unconfirmed reconnect, its held-over
        // forfeit timer is superseded by whatever this disconnect decides next
        // (a signed-in player gets a fresh grace entry below).
        const heldTimer = match.resumePending?.get(playerId);
        if (heldTimer) { clearTimeout(heldTimer); match.resumePending!.delete(playerId); }
        const isPlayer1 = match.player1.id === playerId;
        const playerState = isPlayer1 ? match.player1State : match.player2State;
        const opponentState = isPlayer1 ? match.player2State : match.player1State;
        const stillLive = playerState.status === GameStatus.PLAYING || opponentState.status === GameStatus.PLAYING;
        logVS('disconnect_midmatch', presenceId ?? socket.id, {
          mode: match.mode, myStatus: playerState.status, oppStatus: opponentState.status,
          myGuesses: playerState.guesses, myBoardsSolved: playerState.boardsSolved, stillLive,
        });

        // Signed-in player dropping a still-live match → GRACE, don't forfeit
        // yet. Hold the match open; if they reconnect (same presence id) within
        // the window we re-bind and resume. Only on timeout does it forfeit.
        // Anonymous players (no presence id) can't be re-identified on reconnect,
        // so they forfeit immediately as before.
        if (stillLive && presenceId && playerState.status !== GameStatus.ABANDONED) {
          io.to(isPlayer1 ? match.player2.socketId : match.player1.socketId).emit('opponent_disconnected', { graceSeconds: RECONNECT_GRACE_MS / 1000 });
          const timer = setTimeout(() => {
            pendingReconnects.delete(presenceId);
            const m = matches.get(matchId);
            if (!m) return;
            const stillP1 = m.player1.id === playerId;
            const pState = stillP1 ? m.player1State : m.player2State;
            const oState = stillP1 ? m.player2State : m.player1State;
            if (pState.status === GameStatus.PLAYING || oState.status === GameStatus.PLAYING) {
              pState.status = GameStatus.ABANDONED;
              pState.completedAt = pState.completedAt ?? Date.now();
              logVS('reconnect_grace_expired', presenceId, { mode: m.mode, matchId });
              io.to(stillP1 ? m.player2.socketId : m.player1.socketId).emit('opponent_left');
              endMatch(matchId, playerId);
            }
            cleanupMatch(matchId);
          }, RECONNECT_GRACE_MS);
          pendingReconnects.set(presenceId, { matchId, oldPlayerId: playerId, timer, deadline: Date.now() + RECONNECT_GRACE_MS });
          // Leave the match + lookups intact so the reconnect can re-bind. The
          // disconnected socket's playerToMatch entry is harmless (its id is gone).
          return;
        }

        // No grace (anonymous, or match already finished): forfeit/clean up now.
        if (stillLive) {
          playerState.status = GameStatus.ABANDONED;
          playerState.completedAt = playerState.completedAt ?? Date.now();
          io.to(isPlayer1 ? match.player2.socketId : match.player1.socketId).emit('opponent_left');
          endMatch(matchId, playerId);
        } else {
          // Match already over → the leaver was on the RESULT screen. Tell the
          // remaining player (as a decline) so their rematch button can't hang
          // on "Waiting…" against someone who's gone.
          const opponentSocket = isPlayer1 ? match.player2.socketId : match.player1.socketId;
          io.to(opponentSocket).emit('rematch_declined');
        }

        cleanupMatch(matchId);
      }
    }
  });
});

function createMatch(player1: Player, player2: Player, mode: GameMode, preferredSeed?: string): void {
  const matchId = nextMatchId();
  // If a preferred (daily) seed is supplied, use it verbatim so the
  // solution derivation below produces the same word for everyone
  // playing that day's daily match. Otherwise fall back to the random
  // match seed used for regular ad-hoc VS matchmaking.
  const seed = preferredSeed || generateMatchSeed();
  const boardCount = MODE_BOARD_COUNT[mode] || 1;
  const serverStartAt = Date.now() + MATCH_COUNTDOWN * 1000;

  let solutions: string[];
  let puzzleMetadata: { display: string; category: string; answerLength: number; themeCategory?: string } | undefined;

  if (mode === GameMode.PROPERNOUNDLE && properNoundlePuzzles.length > 0) {
    const puzzle = selectProperNoundlePuzzle(seed);
    solutions = [puzzle.answer];
    puzzleMetadata = {
      display: puzzle.display,
      category: puzzle.category,
      answerLength: puzzle.answer.length,
      themeCategory: puzzle.themeCategory,
    };
  } else {
    solutions = generateSolutionsForMode(mode, seed, boardCount);
  }

  // Opponent identity (Supabase user id from the handshake presenceId) — used
  // for the match-intro splash below AND stored on the match so endMatch still
  // has it after a forfeiter's socket is gone.
  const p1Uid = userIdFromSocket(player1.socketId);
  const p2Uid = userIdFromSocket(player2.socketId);

  const match: Match = {
    id: matchId,
    mode,
    seed,
    player1,
    player2,
    player1UserId: p1Uid,
    player2UserId: p2Uid,
    solutions,
    serverStartAt,
    player1State: { guesses: 0, status: GameStatus.PLAYING, boardsSolved: 0, totalBoards: boardCount },
    player2State: { guesses: 0, status: GameStatus.PLAYING, boardsSolved: 0, totalBoards: boardCount },
    rematchOffers: new Set()
  };
  // Hard cap: no match outlives MATCH_MAX_DURATION_MS past its start.
  match.capTimer = setTimeout(() => timeoutMatch(matchId), (serverStartAt - Date.now()) + MATCH_MAX_DURATION_MS);

  matches.set(matchId, match);
  playerToMatch.set(player1.id, matchId);
  playerToMatch.set(player2.id, matchId);
  submittedWordsByMatch.set(matchId, { p1: new Set(), p2: new Set() });
  guessLogByMatch.set(matchId, { p1: [], p2: [] });

  io.to(player1.socketId).emit('match_found', {
    matchId,
    mode,
    serverStartAt,
    countdownSeconds: MATCH_COUNTDOWN,
    opponentUserId: p2Uid,
  });

  io.to(player2.socketId).emit('match_found', {
    matchId,
    mode,
    serverStartAt,
    countdownSeconds: MATCH_COUNTDOWN,
    opponentUserId: p1Uid,
  });

  setTimeout(() => {
    // A disconnect during the countdown can end the match (anonymous forfeit)
    // before it ever starts — don't fire match_start into a finished match,
    // or the surviving client can see match_ended THEN match_start.
    const m = matches.get(matchId);
    if (!m || m.ended) return;
    io.to(player1.socketId).emit('match_start', { seed, startTime: serverStartAt, puzzleMetadata });
    io.to(player2.socketId).emit('match_start', { seed, startTime: serverStartAt, puzzleMetadata });
  }, MATCH_COUNTDOWN * 1000);
}

/** After the first player finishes, the other must complete within
 *  FINISH_TIMEOUT_MS or the match resolves by current standing. */
function armFinishTimeout(matchId: string): void {
  const match = matches.get(matchId);
  if (!match || match.ended || match.finishTimer) return;
  match.finishTimer = setTimeout(() => timeoutMatch(matchId), FINISH_TIMEOUT_MS);
}

/** Resolve a match whose clock ran out (hard 10-minute cap, or the 3-minute
 *  slow-finisher window): still-PLAYING players become LOST, then the normal
 *  match_ended flow runs — a player who solved beats one who didn't; neither
 *  solved → server-verified board progress decides, else draw. */
function timeoutMatch(matchId: string): void {
  const match = matches.get(matchId);
  if (!match || match.ended) return;
  for (const state of [match.player1State, match.player2State]) {
    if (state.status === GameStatus.PLAYING) {
      state.status = GameStatus.LOST;
      state.completedAt = state.completedAt ?? Date.now();
    }
  }
  logVS('match_timeout', null, { mode: match.mode, matchId });
  endMatch(matchId, undefined, true);
}

/** First in-match event from a rebound socket — proof the reconnect was the
 *  real game client (not the always-on presence socket, which can claim the
 *  slot but has no match handlers). Only now do we disarm the held-over
 *  forfeit and tell the opponent the player is back. */
function confirmResume(match: Match, playerId: string): void {
  const timer = match.resumePending?.get(playerId);
  if (!timer) return;
  clearTimeout(timer);
  match.resumePending!.delete(playerId);
  const opponentSocket = match.player1.id === playerId ? match.player2.socketId : match.player1.socketId;
  io.to(opponentSocket).emit('opponent_reconnected', {});
}

function endMatch(matchId: string, forfeitBy?: string, timedOut = false): void {
  const match = matches.get(matchId);
  if (!match) return;
  // Idempotence: the final submit_guess and the client's player_completed can
  // both reach the "both done" condition — only the first may emit match_ended
  // (a duplicate re-ran winner logic and re-emitted to both players).
  if (match.ended) return;
  match.ended = true;
  // The match is decided — its clocks are moot, and a still-armed resume
  // forfeit must not fire cleanupMatch into the rematch window.
  if (match.capTimer) { clearTimeout(match.capTimer); match.capTimer = undefined; }
  if (match.finishTimer) { clearTimeout(match.finishTimer); match.finishTimer = undefined; }
  if (match.resumePending) { for (const t of match.resumePending.values()) clearTimeout(t); match.resumePending.clear(); }
  // The match object stays alive for a possible rematch, but never forever:
  // if neither rematch nor decline nor a disconnect cleans it up, sweep it.
  setTimeout(() => { if (matches.get(matchId)?.ended) cleanupMatch(matchId); }, ENDED_MATCH_TTL_MS);
  logVS('endMatch', forfeitBy ?? null, {
    mode: match.mode,
    p1Status: match.player1State.status, p2Status: match.player2State.status,
    p1Boards: match.player1State.boardsSolved, p2Boards: match.player2State.boardsSolved,
    forfeit: forfeitBy != null,
  });

  const player1Time = match.player1State.completedAt ? match.player1State.completedAt - match.serverStartAt : Date.now() - match.serverStartAt;
  const player2Time = match.player2State.completedAt ? match.player2State.completedAt - match.serverStartAt : Date.now() - match.serverStartAt;

  let winner: 'player' | 'opponent' | 'draw' | null = null;

  const p1Won = match.player1State.status === GameStatus.WON;
  const p2Won = match.player2State.status === GameStatus.WON;

  if (p1Won && !p2Won) {
    winner = 'player';
  } else if (p2Won && !p1Won) {
    winner = 'opponent';
  } else if (p1Won && p2Won) {
    // First compare boardsSolved (for multi-board modes)
    if (match.player1State.boardsSolved > match.player2State.boardsSolved) {
      winner = 'player';
    } else if (match.player2State.boardsSolved > match.player1State.boardsSolved) {
      winner = 'opponent';
    } else {
      // Composite score: guesses + (timeSeconds / 45)
      // 45 seconds of speed advantage ≈ 1 guess advantage
      const TIME_WEIGHT = 45;
      const p1Score = match.player1State.guesses + (player1Time / 1000 / TIME_WEIGHT);
      const p2Score = match.player2State.guesses + (player2Time / 1000 / TIME_WEIGHT);

      if (Math.abs(p1Score - p2Score) < 0.01) {
        winner = 'draw';
      } else if (p1Score < p2Score) {
        winner = 'player';
      } else {
        winner = 'opponent';
      }
    }
  }

  // A disconnect/abandon forfeits: whoever left loses regardless of board state,
  // so the remaining player is credited the win and it records in their stats.
  if (forfeitBy) {
    winner = forfeitBy === match.player1.id ? 'opponent' : 'player';
  }

  // Timeout resolution: the clock ran out with neither player solving, so the
  // WON-based logic above left winner null (clients render that as a loss for
  // both). Decide by server-verified board progress instead, else draw.
  if (timedOut && winner === null) {
    const p1Solved = match.player1State.serverSolvedSet?.size ?? 0;
    const p2Solved = match.player2State.serverSolvedSet?.size ?? 0;
    if (p1Solved > p2Solved) {
      winner = 'player';
    } else if (p2Solved > p1Solved) {
      winner = 'opponent';
    } else {
      winner = 'draw';
    }
  }

  // Compute composite scores for display
  const TIME_WEIGHT_DISPLAY = 45;
  const p1ScoreDisplay = match.player1State.guesses + (player1Time / 1000 / TIME_WEIGHT_DISPLAY);
  const p2ScoreDisplay = match.player2State.guesses + (player2Time / 1000 / TIME_WEIGHT_DISPLAY);

  // Each player's Supabase user id, resolved and stored at createMatch time —
  // NOT re-read from the live socket, which returns null once a forfeiter's
  // socket is gone (forfeit matches then lost the opponent id and clients
  // skipped the shared matches insert). The client uses it to write a VS
  // match-history row; player1 is the designated single writer (only when it
  // has a real user id), which keeps exactly one row per match without giving
  // the public server DB access.
  const p1UserId = match.player1UserId;
  const p2UserId = match.player2UserId;
  const log = guessLogByMatch.get(matchId) ?? { p1: [], p2: [] };

  // Single writer = player1 by default. On a forfeit the player who LEFT can't
  // write the match-history row, so the REMAINING player writes it — otherwise
  // forfeited matches never appear in Recent Matches.
  const remainingIsP1 = forfeitBy == null || forfeitBy !== match.player1.id;
  const p1Records = remainingIsP1 && p1UserId !== null;
  const p2Records = !remainingIsP1 && p2UserId !== null;

  io.to(match.player1.socketId).emit('match_ended', {
    winner: winner === 'opponent' ? 'opponent' : winner === 'player' ? 'player' : winner,
    playerGuesses: match.player1State.guesses,
    opponentGuesses: match.player2State.guesses,
    playerTime: player1Time,
    opponentTime: player2Time,
    playerScore: Math.round(p1ScoreDisplay * 100) / 100,
    opponentScore: Math.round(p2ScoreDisplay * 100) / 100,
    opponentId: p2UserId,
    recordMatch: p1Records,
    forfeit: forfeitBy != null,
    opponentGuessLog: log.p2,
    solutions: match.solutions,
  });

  io.to(match.player2.socketId).emit('match_ended', {
    winner: winner === 'player' ? 'opponent' : winner === 'opponent' ? 'player' : winner,
    playerGuesses: match.player2State.guesses,
    opponentGuesses: match.player1State.guesses,
    playerTime: player2Time,
    opponentTime: player1Time,
    playerScore: Math.round(p2ScoreDisplay * 100) / 100,
    opponentScore: Math.round(p1ScoreDisplay * 100) / 100,
    opponentId: p1UserId,
    recordMatch: p2Records,
    forfeit: forfeitBy != null,
    opponentGuessLog: log.p1,
    solutions: match.solutions,
  });
}

/** Extract the Supabase user id from a connected socket's presenceId (`u:<id>`), or null. */
function userIdFromSocket(socketId: string): string | null {
  const sock = io.sockets.sockets.get(socketId);
  const pid = (sock?.data as { presenceId?: string } | undefined)?.presenceId;
  return pid && pid.startsWith('u:') ? pid.slice(2) : null;
}

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
