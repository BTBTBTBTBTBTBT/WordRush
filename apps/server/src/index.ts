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

const MODE_BOARD_COUNT: Record<string, number> = {
  [GameMode.DUEL]: 1,
  [GameMode.QUORDLE]: 4,
  [GameMode.OCTORDLE]: 8,
  [GameMode.SEQUENCE]: 4,
  [GameMode.RESCUE]: 4,
  [GameMode.GAUNTLET]: 21,
  [GameMode.MULTI_DUEL]: 2,
  [GameMode.TOURNAMENT]: 1
};

const MODE_MAX_GUESSES: Record<string, number> = {
  [GameMode.DUEL]: 6,
  [GameMode.QUORDLE]: 9,
  [GameMode.OCTORDLE]: 13,
  [GameMode.SEQUENCE]: 10,
  [GameMode.RESCUE]: 6,
  [GameMode.GAUNTLET]: 50,
  [GameMode.MULTI_DUEL]: 6,
  [GameMode.TOURNAMENT]: 6
};

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

    const maxGuesses = MODE_MAX_GUESSES[match.mode] || 6;

    if (isCorrect) {
      // For single-board modes, mark done
      if (MODE_BOARD_COUNT[match.mode] === 1) {
        playerState.status = GameStatus.WON;
        playerState.completedAt = Date.now();
      }
    } else if (playerState.guesses >= maxGuesses) {
      playerState.status = GameStatus.LOST;
      playerState.completedAt = Date.now();
    }

    io.to(opponentSocket).emit('opponent_progress', {
      attempts: playerState.guesses,
      solved: playerState.status === GameStatus.WON,
      boardsSolved: playerState.boardsSolved,
      totalBoards: playerState.totalBoards
    });

    if (playerState.status !== GameStatus.PLAYING && opponentState.status !== GameStatus.PLAYING) {
      endMatch(matchId);
    }
  });

  socket.on('board_solved', ({ boardIndex }) => {
    const matchId = playerToMatch.get(playerId);
    if (!matchId) return;

    const match = matches.get(matchId);
    if (!match) return;

    const isPlayer1 = match.player1.id === playerId;
    const playerState = isPlayer1 ? match.player1State : match.player2State;
    const opponentSocket = isPlayer1 ? match.player2.socketId : match.player1.socketId;

    playerState.boardsSolved++;

    io.to(opponentSocket).emit('opponent_progress', {
      attempts: playerState.guesses,
      solved: playerState.boardsSolved >= playerState.totalBoards,
      boardsSolved: playerState.boardsSolved,
      totalBoards: playerState.totalBoards
    });
  });

  socket.on('player_completed', ({ status, totalGuesses, timeMs }) => {
    const matchId = playerToMatch.get(playerId);
    if (!matchId) return;

    const match = matches.get(matchId);
    if (!match) return;

    const isPlayer1 = match.player1.id === playerId;
    const playerState = isPlayer1 ? match.player1State : match.player2State;
    const opponentState = isPlayer1 ? match.player2State : match.player1State;

    playerState.status = status === 'won' ? GameStatus.WON : GameStatus.LOST;
    playerState.completedAt = Date.now();
    playerState.guesses = totalGuesses;

    if (playerState.status !== GameStatus.PLAYING && opponentState.status !== GameStatus.PLAYING) {
      endMatch(matchId);
    }
  });

  socket.on('stage_completed', ({ stageIndex }) => {
    const matchId = playerToMatch.get(playerId);
    if (!matchId) return;

    const match = matches.get(matchId);
    if (!match) return;

    const isPlayer1 = match.player1.id === playerId;
    const playerState = isPlayer1 ? match.player1State : match.player2State;
    const opponentSocket = isPlayer1 ? match.player2.socketId : match.player1.socketId;

    playerState.currentStage = stageIndex;

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
      const boardCount = MODE_BOARD_COUNT[match.mode] || 1;
      const newMatch: Match = {
        id: newMatchId,
        mode: match.mode,
        seed: newSeed,
        player1: match.player1,
        player2: match.player2,
        solutions: generateSolutionsFromSeed(newSeed, boardCount),
        serverStartAt: Date.now() + MATCH_COUNTDOWN * 1000,
        player1State: { guesses: 0, status: GameStatus.PLAYING, boardsSolved: 0, totalBoards: boardCount },
        player2State: { guesses: 0, status: GameStatus.PLAYING, boardsSolved: 0, totalBoards: boardCount },
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
  const boardCount = MODE_BOARD_COUNT[mode] || 1;
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
    player1State: { guesses: 0, status: GameStatus.PLAYING, boardsSolved: 0, totalBoards: boardCount },
    player2State: { guesses: 0, status: GameStatus.PLAYING, boardsSolved: 0, totalBoards: boardCount },
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
    } else if (match.player1State.guesses < match.player2State.guesses) {
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
