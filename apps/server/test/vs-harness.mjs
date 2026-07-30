#!/usr/bin/env node
/**
 * Headless two-player VS harness.
 *
 * VS is the least-tested surface in the product for an obvious reason: every
 * scenario needs two humans on two devices at the same time. This drives two
 * real socket.io clients against a LOCAL server instance, so the whole matrix —
 * normal play, simultaneous finishes, disconnects, forfeits, rematches, abuse —
 * runs in seconds with nobody else in the room.
 *
 * Run against a local server only (never production; matches are real):
 *   cd apps/server && npx tsx src/index.ts          # terminal 1
 *   node test/vs-harness.mjs                        # terminal 2
 *
 * Exits non-zero if any scenario fails.
 */
import { io } from 'socket.io-client';

const URL = process.env.VS_URL || 'http://localhost:3001';
const MODE = process.env.VS_MODE || 'DUEL';
/** Countdown before match_start; scenarios that play must wait it out. */
const COUNTDOWN_MS = 4000;

let failures = 0;
const log = (...a) => console.log(...a);
function check(name, cond, detail = '') {
  if (cond) { log(`  ✓ ${name}`); }
  else { failures++; log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
}

/** A scripted player. Records every event so assertions can inspect ordering. */
function makePlayer(tag, userId) {
  const socket = io(URL, {
    transports: ['websocket'],
    auth: { presenceId: `u:${userId}` },
    forceNew: true,
  });
  const events = [];
  const waiters = [];
  socket.onAny((name, payload) => {
    events.push({ name, payload, at: Date.now() });
    for (let i = waiters.length - 1; i >= 0; i--) {
      if (waiters[i].name === name) { waiters[i].resolve(payload); waiters.splice(i, 1); }
    }
  });
  return {
    tag, userId, socket, events,
    seen: (name) => events.filter((e) => e.name === name),
    /**
     * Resolve with the event's payload, or null on timeout.
     *
     * Payload-less events (the server emits `opponent_left` with no argument)
     * resolve to `{}` rather than undefined — otherwise callers doing the
     * natural `!!result` check read "arrived, but empty" as "never arrived",
     * which briefly had this harness reporting a working forfeit as broken.
     */
    wait(name, ms = 8000) {
      const already = events.find((e) => e.name === name);
      if (already) return Promise.resolve(already.payload === undefined ? {} : already.payload);
      return new Promise((resolve) => {
        const w = { name, resolve: (p) => resolve(p === undefined ? {} : p) };
        waiters.push(w);
        setTimeout(() => {
          const i = waiters.indexOf(w);
          if (i >= 0) { waiters.splice(i, 1); resolve(null); }
        }, ms);
      });
    },
    emit: (...a) => socket.emit(...a),
    close: () => socket.close(),
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let seq = 0;
const nextUser = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;

/**
 * Assert the socket is actually connected. Several checks below are of the form
 * "X did NOT happen", which a DEAD SERVER satisfies trivially — an early run of
 * this harness reported two spoofing scenarios as passing when in fact nothing
 * was listening. Absence of evidence only counts while the line is up.
 */
function requireLive(...players) {
  for (const p of players) {
    if (!p.socket.connected) {
      throw new Error(`${p.tag} lost its connection — server down? Results would be meaningless.`);
    }
  }
}

/** Pair two fresh clients through the queue and return them mid-match. */
async function pair(mode = MODE) {
  const a = makePlayer('A', nextUser());
  const b = makePlayer('B', nextUser());
  await Promise.all([a.wait('connect', 5000), b.wait('connect', 5000)]);
  requireLive(a, b);
  a.emit('join_queue', { mode });
  await sleep(150);
  b.emit('join_queue', { mode });
  const [fa, fb] = await Promise.all([a.wait('match_found'), b.wait('match_found')]);
  if (!fa || !fb) throw new Error('matchmaking produced no match — cannot evaluate this scenario');
  return { a, b, fa, fb };
}

// ---------------------------------------------------------------- scenarios

async function scenarioMatchmaking() {
  log('\n[1] Matchmaking pairs two players into one match');
  const { a, b, fa, fb } = await pair();
  check('both got match_found', !!fa && !!fb);
  check('same matchId', fa?.matchId === fb?.matchId, `${fa?.matchId} vs ${fb?.matchId}`);
  check('opponentUserId is the OTHER player', fa?.opponentUserId === b.userId && fb?.opponentUserId === a.userId,
    `A saw ${fa?.opponentUserId}, B saw ${fb?.opponentUserId}`);
  check('server-authoritative start time present', typeof fa?.serverStartAt === 'number');

  const [sa, sb] = await Promise.all([a.wait('match_start', 8000), b.wait('match_start', 8000)]);
  check('both got match_start', !!sa && !!sb);
  check('identical seed for both players', sa?.seed === sb?.seed, `${sa?.seed} vs ${sb?.seed}`);
  a.close(); b.close();
}

async function scenarioGuessBeforeStart() {
  log('\n[2] Guesses during the countdown are rejected, not applied');
  const { a, b } = await pair();
  a.emit('submit_guess', { guess: 'CRANE' });
  const early = await a.wait('guess_result', 1500);
  // Regression guard: the server used to SCORE this (isValid:true). Because
  // endMatch times a player as `completedAt - serverStartAt`, a client that
  // banked guesses during the countdown could finish with a NEGATIVE duration —
  // ahead of every honest result on time-based tiebreaks.
  check('countdown guess is not scored', !early || early.isValid === false,
    early ? JSON.stringify(early).slice(0, 140) : 'none');
  if (early) check('rejection explains why', /not started/i.test(early.reason ?? ''),
    JSON.stringify(early).slice(0, 140));
  a.close(); b.close();
}

async function scenarioInvalidWords() {
  log('\n[3] Garbage guesses are rejected and do not consume a turn');
  const { a, b } = await pair();
  await a.wait('match_start', 8000);
  await sleep(200);
  a.emit('submit_guess', { guess: 'ZZZZZ' });
  const r = await a.wait('guess_result', 4000);
  check('server answered the invalid guess', !!r);
  if (r) check('marked invalid rather than scored', r.isValid === false,
    JSON.stringify(r).slice(0, 160));
  if (r) check('rejection carries a reason for the UI', typeof r.reason === 'string' && r.reason.length > 0,
    JSON.stringify(r).slice(0, 160));
  a.close(); b.close();
}

async function scenarioAbandon() {
  log('\n[4] Abandoning tells the opponent, and only the opponent');
  const { a, b } = await pair();
  await Promise.all([a.wait('match_start', 8000), b.wait('match_start', 8000)]);
  await sleep(300);   // let match_start settle on both sides before abandoning
  a.emit('abandon_match');
  const left = await b.wait('opponent_left', 5000);
  check('B was told the opponent left', !!left,
    left ? '' : `B saw: ${b.events.map((e) => e.name).join(',')}`);
  check('A did not receive its own opponent_left', a.seen('opponent_left').length === 0);
  a.close(); b.close();
}

async function scenarioDisconnectGrace() {
  log('\n[5] A hard disconnect gives the opponent a grace notice, not an instant loss');
  const { a, b } = await pair();
  await Promise.all([a.wait('match_start', 8000), b.wait('match_start', 8000)]);
  a.socket.disconnect();
  const dc = await b.wait('opponent_disconnected', 5000);
  check('B got opponent_disconnected with a grace window', !!dc && typeof dc.graceSeconds === 'number',
    dc ? JSON.stringify(dc) : 'none');
  check('B was NOT immediately told opponent_left', b.seen('opponent_left').length === 0);
  b.close();
}

async function scenarioDoubleQueue() {
  log('\n[6] Double join_queue does not self-match or wedge the queue');
  const a = makePlayer('A', nextUser());
  await a.wait('connect', 5000);
  a.emit('join_queue', { mode: MODE });
  a.emit('join_queue', { mode: MODE });
  await sleep(800);
  requireLive(a);
  check('never matched against itself', a.seen('match_found').length === 0,
    `${a.seen('match_found').length} match_found`);

  const b = makePlayer('B', nextUser());
  await b.wait('connect', 5000);
  b.emit('join_queue', { mode: MODE });
  const found = await a.wait('match_found', 6000);
  check('queue still pairs a real second player afterwards', !!found);
  a.close(); b.close();
}

async function scenarioForeignMatchSpoof() {
  log('\n[7] A third party cannot act inside someone else\'s match');
  const { a, b } = await pair();
  await Promise.all([a.wait('match_start', 8000), b.wait('match_start', 8000)]);
  const c = makePlayer('C', nextUser());
  await c.wait('connect', 5000);
  c.emit('submit_guess', { guess: 'CRANE' });
  c.emit('player_completed', { status: 'won', totalGuesses: 1, timeMs: 1 });
  await sleep(600);
  requireLive(a, b, c);   // negative checks below are meaningless on a dead socket
  check('outsider got an error, not a guess_result', c.seen('guess_result').length === 0);
  check('neither player saw the outsider\'s progress',
    a.seen('opponent_progress').length === 0 && b.seen('opponent_progress').length === 0);
  check('outsider could not end the match',
    a.seen('match_ended').length === 0 && b.seen('match_ended').length === 0);
  a.close(); b.close(); c.close();
}

async function scenarioSelfReportedWin() {
  log('\n[8] player_completed is not blindly trusted');
  const { a, b } = await pair();
  await Promise.all([a.wait('match_start', 8000), b.wait('match_start', 8000)]);
  // A claims a 1-guess 1ms win without ever submitting a guess.
  a.emit('player_completed', { status: 'won', totalGuesses: 1, timeMs: 1 });
  const ended = await a.wait('match_ended', 5000);
  requireLive(a, b);      // "no match_ended" only counts if we're still connected
  if (!ended) {
    check('unverified win claim did not end the match', true);
  } else {
    const w = JSON.stringify(ended).slice(0, 200);
    check('if honored, the server supplied its own guess count (not the claimed 1)',
      ended.player1?.guesses !== 1 || ended.player2?.guesses !== 1, w);
  }
  a.close(); b.close();
}


async function scenarioBoardIndexBounds() {
  log('\n[9] Out-of-range boardIndex cannot crash the server or fake a win');
  const { a, b } = await pair('QUORDLE');
  await Promise.all([a.wait('match_start', 8000), b.wait('match_start', 8000)]);
  await sleep(200);
  // match.solutions[boardIndex] used to be read unchecked, so undefined
  // .toUpperCase() threw inside the handler and took the process down —
  // one packet, every live match gone.
  for (const bad of [999, -1, 1.5, 'x', null]) {
    a.emit('submit_guess', { guess: 'CRANE', boardIndex: bad });
  }
  // board_solved incremented boardsSolved with no validation or dedup, so
  // spamming it past totalBoards fabricated a win in multi-board modes.
  for (let i = 0; i < 12; i++) a.emit('board_solved', { boardIndex: 99 });
  for (let i = 0; i < 12; i++) a.emit('board_solved', { boardIndex: 0 });
  await sleep(1200);

  requireLive(a, b);
  check('server survived the malformed packets', a.socket.connected && b.socket.connected);
  check('opponent was not told of a fabricated sweep',
    !b.events.some((e) => e.name === 'opponent_progress' && (e.payload?.boardsSolved ?? 0) > 4),
    JSON.stringify(b.seen('opponent_progress').map((e) => e.payload?.boardsSolved)));
  check('no fabricated match end', a.seen('match_ended').length === 0);

  // Still functional afterwards.
  a.emit('submit_guess', { guess: 'CRANE', boardIndex: 0 });
  const ok = await a.wait('guess_result', 4000);
  check('valid guesses still work after the abuse', !!ok);
  a.close(); b.close();
}


async function scenarioRematch() {
  log('\n[10] Rematch: both accept → a fresh match with a NEW seed');
  const { a, b } = await pair();
  const [sa] = await Promise.all([a.wait('match_start', 8000), b.wait('match_start', 8000)]);
  await sleep(300);
  a.emit('abandon_match');                 // end the match so a rematch is legal
  await Promise.all([a.wait('match_ended', 5000), b.wait('match_ended', 5000)]);

  a.emit('offer_rematch');
  const offered = await b.wait('rematch_offered', 5000);
  check('opponent saw the rematch offer', !!offered,
    offered ? '' : `B saw: ${b.events.map((e) => e.name).join(',')}`);
  if (!offered) { a.close(); b.close(); return; }

  b.emit('offer_rematch');                 // accepting is offering back
  const [ra, rb] = await Promise.all([a.wait('rematch_start', 8000), b.wait('rematch_start', 8000)]);
  check('both players entered the rematch', !!ra && !!rb);
  check('rematch has its own matchId', ra?.matchId && ra.matchId === rb?.matchId,
    `${ra?.matchId} vs ${rb?.matchId}`);
  check('rematch uses a DIFFERENT seed than the first match', ra?.seed && ra.seed !== sa?.seed,
    `first=${sa?.seed} rematch=${ra?.seed}`);
  a.close(); b.close();
}

async function scenarioDeclineRematch() {
  log('\n[11] Declining a rematch resolves the offerer, not hangs it');
  const { a, b } = await pair();
  await Promise.all([a.wait('match_start', 8000), b.wait('match_start', 8000)]);
  await sleep(300);
  a.emit('abandon_match');
  await Promise.all([a.wait('match_ended', 5000), b.wait('match_ended', 5000)]);
  a.emit('offer_rematch');
  await b.wait('rematch_offered', 5000);
  b.emit('decline_rematch');
  const declined = await a.wait('rematch_declined', 5000);
  check('offerer got rematch_declined (button resolves)', !!declined);
  a.close(); b.close();
}

async function scenarioReconnectResume() {
  log('\n[12] Reconnecting inside the grace window resumes the SAME match');
  const a = makePlayer('A', nextUser());
  const b = makePlayer('B', nextUser());
  await Promise.all([a.wait('connect', 5000), b.wait('connect', 5000)]);
  requireLive(a, b);
  a.emit('join_queue', { mode: MODE });
  await sleep(150);
  b.emit('join_queue', { mode: MODE });
  const fa = await a.wait('match_found');
  await Promise.all([a.wait('match_start', 8000), b.wait('match_start', 8000)]);

  a.socket.disconnect();
  await sleep(800);
  // Same presenceId (u:<userId>) = the same player returning on a new socket.
  const a2Same = makePlayer('A-again', a.userId);
  await a2Same.wait('connect', 5000);
  const resumed = await a2Same.wait('match_resumed', 6000);
  check('returning player was handed back their match', !!resumed,
    resumed ? '' : `saw: ${a2Same.events.map((e) => e.name).join(',')}`);
  if (resumed) check('resumed into the SAME match', resumed.matchId === fa?.matchId,
    `${resumed.matchId} vs ${fa?.matchId}`);
  check('opponent was never told the player left', b.seen('opponent_left').length === 0);
  a2Same.close(); b.close();
}

// -------------------------------------------------------------------- main

const scenarios = [
  scenarioMatchmaking,
  scenarioGuessBeforeStart,
  scenarioInvalidWords,
  scenarioAbandon,
  scenarioDisconnectGrace,
  scenarioDoubleQueue,
  scenarioForeignMatchSpoof,
  scenarioSelfReportedWin,
  scenarioBoardIndexBounds,
  scenarioRematch,
  scenarioDeclineRematch,
  scenarioReconnectResume,
];

(async () => {
  log(`VS harness → ${URL} (mode ${MODE})`);
  const probe = io(URL, { transports: ['websocket'], auth: { presenceId: 'u:probe' }, forceNew: true });
  const up = await new Promise((r) => {
    probe.on('connect', () => r(true));
    probe.on('connect_error', () => r(false));
    setTimeout(() => r(false), 4000);
  });
  probe.close();
  if (!up) {
    console.error(`\nNo server at ${URL}. Start it first:\n  cd apps/server && npx tsx src/index.ts\n`);
    process.exit(2);
  }

  for (const s of scenarios) {
    try { await s(); } catch (e) { failures++; log(`  ✗ threw: ${e?.message ?? e}`); }
  }

  log(`\n${failures === 0 ? 'PASS' : `FAIL — ${failures} check(s)`}`);
  process.exit(failures === 0 ? 0 : 1);
})();
