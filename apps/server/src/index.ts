import { Server } from 'socket.io';
import { createServer } from 'http';
import { initDictionary, generateMatchSeed, generateSolutionsFromSeed, isValidWord, GameMode, GameStatus } from '@wordle-duel/core';
import { readFileSync } from 'fs';
import { join } from 'path';
import { MatchmakingQueue } from './matchmaking';
import { Match, Player, ClientToServerEvents, ServerToClientEvents } from './types';

const allowedWords = JSON.parse(readFileSync(join(__dirname, '../../../data/allowed.json'), 'utf-8'));
const solutionWords = JSON.parse(readFileSync(join(__dirname, '../../../data/solutions.json'), 'utf-8'));
initDictionary(allowedWords, solutionWords);

const httpServer = createServer();
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

const queue = new MatchmakingQueue();
const matches = new Map<string, Match>();
const playerToMatch = new Map<string, string>();
const MATCH_COUNTDOWN = 3;
const REMATCH_TIMEOUT = 30000;

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  const playerId = socket.id;
  const player: Player = {
    id: playerId,
    socketId: socket.id,
    rating: 1000
  };

  socket.on('join_queue', ({ mode }) => {
    queue.removeFromQueue(playerId);
    const position = queue.addToQueue(player, mode);

    socket.emit('queue_status', { position, mode });

    const matchPair = queue.findMatch(mode);
    if (matchPair) {
      const [entry1, entry2] = matchPair;
      createMatch(entry1.player, entry2.player, mode);
    }
  });

  socket.on('leave_queue', () => {
    queue.removeFromQueue(playerId);
  });

  socket.on('submit_guess', ({ guess, boardIndex = 0 }) => {
    const matchId = playerToMatch.get(playerId);
    if (!matchId) {
      socket.emit('error', { message: 'Not in a match' });
      return;
    }

    const match = matches.get(matchId);
    if (!match) {
      socket.emit('error', { message: 'Match not found' });
      return;
    }

    if (guess.length !== 5) {
      socket.emit('guess_result', {
        boardIndex,
        isValid: false,
        isCorrect: false,
        reason: 'Guess must be 5 letters'
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

    const isPlayer1 = match.player1.id === playerId;
    const playerState = isPlayer1 ? match.player1State : match.player2State;
    const opponentState = isPlayer1 ? match.player2State : match.player1State;
    const opponentSocket = isPlayer1 ? match.player2.socketId : match.player1.socketId;

    if (playerState.status !== GameStatus.PLAYING) {
      socket.emit('error', { message: 'Game already completed' });
      return;
    }

    const solution = match.solutions[boardIndex];
    const isCorrect = guess.toUpperCase() === solution.toUpperCase();

    playerState.guesses++;

    socket.emit('guess_result', {
      boardIndex,
      isValid: true,
      isCorrect
    });

    if (isCorrect) {
      playerState.status = GameStatus.WON;
      playerState.completedAt = Date.now();
    } else if (playerState.guesses >= 6) {
      playerState.status = GameStatus.LOST;
      playerState.completedAt = Date.now();
    }

    io.to(opponentSocket).emit('opponent_progress', {
      attempts: playerState.guesses,
      solved: playerState.status === GameStatus.WON
    });

    if (playerState.status !== GameStatus.PLAYING && opponentState.status !== GameStatus.PLAYING) {
      endMatch(matchId);
    }
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

    endMatch(matchId);
  });

  socket.on('offer_rematch', () => {
    const matchId = playerToMatch.get(playerId);
    if (!matchId) return;

    const match = matches.get(matchId);
    if (!match) return;

    match.rematchOffers.add(playerId);

    const isPlayer1 = match.player1.id === playerId;
    const opponentSocket = isPlayer1 ? match.player2.socketId : match.player1.socketId;

    io.to(opponentSocket).emit('rematch_offered');

    if (match.rematchOffers.size === 2) {
      const newMatchId = `match-${Date.now()}`;
      const newSeed = generateMatchSeed();
      const newMatch: Match = {
        id: newMatchId,
        mode: match.mode,
        seed: newSeed,
        player1: match.player1,
        player2: match.player2,
        solutions: generateSolutionsFromSeed(newSeed, match.mode === GameMode.DUEL ? 1 : match.mode === GameMode.MULTI_DUEL ? 2 : 3),
        serverStartAt: Date.now() + MATCH_COUNTDOWN * 1000,
        player1State: { guesses: 0, status: GameStatus.PLAYING },
        player2State: { guesses: 0, status: GameStatus.PLAYING },
        rematchOffers: new Set()
      };

      matches.set(newMatchId, newMatch);
      playerToMatch.set(match.player1.id, newMatchId);
      playerToMatch.set(match.player2.id, newMatchId);
      matches.delete(matchId);

      io.to(match.player1.socketId).emit('rematch_start', { matchId: newMatchId, seed: newSeed });
      io.to(match.player2.socketId).emit('rematch_start', { matchId: newMatchId, seed: newSeed });
    }
  });

  socket.on('decline_rematch', () => {
    const matchId = playerToMatch.get(playerId);
    if (!matchId) return;

    const match = matches.get(matchId);
    if (!match) return;

    const isPlayer1 = match.player1.id === playerId;
    const opponentSocket = isPlayer1 ? match.player2.socketId : match.player1.socketId;

    io.to(opponentSocket).emit('rematch_declined');

    playerToMatch.delete(match.player1.id);
    playerToMatch.delete(match.player2.id);
    matches.delete(matchId);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);

    queue.removeFromQueue(playerId);

    const matchId = playerToMatch.get(playerId);
    if (matchId) {
      const match = matches.get(matchId);
      if (match) {
        const isPlayer1 = match.player1.id === playerId;
        const opponentSocket = isPlayer1 ? match.player2.socketId : match.player1.socketId;
        io.to(opponentSocket).emit('opponent_left');

        playerToMatch.delete(match.player1.id);
        playerToMatch.delete(match.player2.id);
        matches.delete(matchId);
      }
    }
  });
});

function createMatch(player1: Player, player2: Player, mode: GameMode): void {
  const matchId = `match-${Date.now()}`;
  const seed = generateMatchSeed();
  const boardCount = mode === GameMode.DUEL ? 1 : mode === GameMode.MULTI_DUEL ? 2 : 3;
  const solutions = generateSolutionsFromSeed(seed, boardCount);
  const serverStartAt = Date.now() + MATCH_COUNTDOWN * 1000;

  const match: Match = {
    id: matchId,
    mode,
    seed,
    player1,
    player2,
    solutions,
    serverStartAt,
    player1State: { guesses: 0, status: GameStatus.PLAYING },
    player2State: { guesses: 0, status: GameStatus.PLAYING },
    rematchOffers: new Set()
  };

  matches.set(matchId, match);
  playerToMatch.set(player1.id, matchId);
  playerToMatch.set(player2.id, matchId);

  io.to(player1.socketId).emit('match_found', {
    matchId,
    mode,
    serverStartAt,
    countdownSeconds: MATCH_COUNTDOWN
  });

  io.to(player2.socketId).emit('match_found', {
    matchId,
    mode,
    serverStartAt,
    countdownSeconds: MATCH_COUNTDOWN
  });

  setTimeout(() => {
    io.to(player1.socketId).emit('match_start', { seed, startTime: serverStartAt });
    io.to(player2.socketId).emit('match_start', { seed, startTime: serverStartAt });
  }, MATCH_COUNTDOWN * 1000);
}

function endMatch(matchId: string): void {
  const match = matches.get(matchId);
  if (!match) return;

  const player1Time = match.player1State.completedAt ? match.player1State.completedAt - match.serverStartAt : Date.now() - match.serverStartAt;
  const player2Time = match.player2State.completedAt ? match.player2State.completedAt - match.serverStartAt : Date.now() - match.serverStartAt;

  let winner: 'player' | 'opponent' | 'draw' | null = null;

  if (match.player1State.status === GameStatus.WON && match.player2State.status !== GameStatus.WON) {
    winner = 'player';
  } else if (match.player2State.status === GameStatus.WON && match.player1State.status !== GameStatus.WON) {
    winner = 'opponent';
  } else if (match.player1State.status === GameStatus.WON && match.player2State.status === GameStatus.WON) {
    if (match.player1State.guesses < match.player2State.guesses) {
      winner = 'player';
    } else if (match.player2State.guesses < match.player1State.guesses) {
      winner = 'opponent';
    } else if (player1Time < player2Time) {
      winner = 'player';
    } else if (player2Time < player1Time) {
      winner = 'opponent';
    } else {
      winner = 'draw';
    }
  }

  io.to(match.player1.socketId).emit('match_ended', {
    winner: winner === 'opponent' ? 'opponent' : winner === 'player' ? 'player' : winner,
    playerGuesses: match.player1State.guesses,
    opponentGuesses: match.player2State.guesses,
    playerTime: player1Time,
    opponentTime: player2Time
  });

  io.to(match.player2.socketId).emit('match_ended', {
    winner: winner === 'player' ? 'opponent' : winner === 'opponent' ? 'player' : winner,
    playerGuesses: match.player2State.guesses,
    opponentGuesses: match.player1State.guesses,
    playerTime: player2Time,
    opponentTime: player1Time
  });
}

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
