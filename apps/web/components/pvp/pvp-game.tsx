'use client';

import { useReducer, useState, useEffect } from 'react';
import { GameMode, GameStatus, GuessResult, evaluateGuess, gameReducer, createInitialState, generateMatchSeed, isValidWord } from '@wordle-duel/core';
import { Board } from '@/components/game/board';
import { Keyboard } from '@/components/game/keyboard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SocketIOMatchService } from '@/lib/adapters/match-service';
import { usePresenceId } from '@/lib/presence-id';
import { Loader2 } from 'lucide-react';
import { ensureDictionaryInitialized } from '@/lib/init-dictionary';

interface PvPGameProps {
  mode: GameMode;
  onBack: () => void;
}

type PvPScreen = 'queue' | 'warmup' | 'match' | 'result';

export function PvPGame({ mode, onBack }: PvPGameProps) {
  ensureDictionaryInitialized();
  const [screen, setScreen] = useState<PvPScreen>('queue');
  const [matchService] = useState(() => new SocketIOMatchService(process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001'));
  const presenceId = usePresenceId();
  const [state, dispatch] = useReducer(gameReducer, createInitialState(generateMatchSeed(), mode));
  const [currentGuess, setCurrentGuess] = useState('');
  const [evaluations, setEvaluations] = useState<GuessResult[]>([]);
  const [letterStates, setLetterStates] = useState<Record<string, 'correct' | 'present' | 'absent'>>({});
  const [message, setMessage] = useState('');
  const [queuePosition, setQueuePosition] = useState(0);
  const [opponentProgress, setOpponentProgress] = useState({ attempts: 0, solved: false });
  const [matchResult, setMatchResult] = useState<any>(null);
  const [showMatchFoundDialog, setShowMatchFoundDialog] = useState(false);
  const [countdown, setCountdown] = useState(3);

  const currentBoard = state.boards[state.currentBoardIndex];

  useEffect(() => {
    matchService.connect(presenceId);

    matchService.onQueueStatus((data) => {
      setQueuePosition(data.position);
    });

    matchService.onMatchFound((data) => {
      setShowMatchFoundDialog(true);
      setCountdown(data.countdownSeconds);

      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      setTimeout(() => {
        setShowMatchFoundDialog(false);
        setScreen('match');
      }, data.countdownSeconds * 1000);
    });

    matchService.onMatchStart((data) => {
      dispatch({ type: 'RESET', seed: data.seed, mode });
      setScreen('match');
      setEvaluations([]);
      setLetterStates({});
      setCurrentGuess('');
      setMessage('');
    });

    matchService.onGuessResult((data) => {
      if (!data.isValid) {
        setMessage(data.reason || 'Invalid guess');
      }
    });

    matchService.onOpponentProgress((data) => {
      setOpponentProgress(data);
    });

    matchService.onMatchEnded((data) => {
      setMatchResult(data);
      setScreen('result');
    });

    matchService.onOpponentLeft(() => {
      setMessage('Opponent left the match');
      setTimeout(() => {
        onBack();
      }, 2000);
    });

    matchService.onError((data) => {
      setMessage(data.message);
    });

    matchService.joinQueue(mode);

    return () => {
      matchService.disconnect();
    };
  }, [mode, matchService, onBack]);

  const handleKey = (key: string) => {
    if (currentBoard.status !== GameStatus.PLAYING) return;

    setMessage('');

    if (key === 'ENTER') {
      if (currentGuess.length !== 5) {
        setMessage('Word must be 5 letters');
        return;
      }

      if (currentBoard.guesses.includes(currentGuess.toUpperCase())) {
        setMessage('Already guessed');
        setTimeout(() => setMessage(''), 1500);
        return;
      }

      matchService.submitGuess(currentGuess, state.currentBoardIndex);

      try {
        const evaluation = evaluateGuess(currentBoard.solution, currentGuess);
        setEvaluations([...evaluations, evaluation]);

        const newLetterStates = { ...letterStates };
        evaluation.tiles.forEach((tile) => {
          const letter = tile.letter;
          const currentState = newLetterStates[letter];

          if (tile.state === 'CORRECT') {
            newLetterStates[letter] = 'correct';
          } else if (tile.state === 'PRESENT' && currentState !== 'correct') {
            newLetterStates[letter] = 'present';
          } else if (tile.state === 'ABSENT' && !currentState) {
            newLetterStates[letter] = 'absent';
          }
        });
        setLetterStates(newLetterStates);

        dispatch({ type: 'SUBMIT_GUESS', guess: currentGuess, boardIndex: state.currentBoardIndex });
        setCurrentGuess('');
      } catch (error) {
        setMessage('Not in word list');
      }
    } else if (key === 'BACK') {
      setCurrentGuess(currentGuess.slice(0, -1));
    } else if (currentGuess.length < 5) {
      setCurrentGuess(currentGuess + key);
    }
  };

  const handleStartMatch = () => {
    setShowMatchFoundDialog(false);
    setScreen('match');
  };

  if (screen === 'queue' || screen === 'warmup') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <h2 className="text-2xl font-bold">Finding Opponent...</h2>
          <p className="text-muted-foreground">Position in queue: {queuePosition + 1}</p>
          <Button variant="outline" onClick={onBack}>Cancel</Button>
        </Card>

        <Dialog open={showMatchFoundDialog} onOpenChange={() => {}}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Match Found!</DialogTitle>
              <DialogDescription>
                Starting in {countdown} seconds...
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={handleStartMatch}>Start Now</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (screen === 'result') {
    const winner = matchResult?.winner;
    const winText = winner === 'player' ? 'You Won!' : winner === 'opponent' ? 'You Lost' : 'Draw';

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center space-y-4">
          <h2 className="text-3xl font-bold">{winText}</h2>
          <div className="space-y-2 text-left">
            <div className="flex justify-between">
              <span>Your Guesses:</span>
              <span className="font-bold">{matchResult?.playerGuesses}</span>
            </div>
            <div className="flex justify-between">
              <span>Opponent Guesses:</span>
              <span className="font-bold">{matchResult?.opponentGuesses}</span>
            </div>
            <div className="flex justify-between">
              <span>Your Time:</span>
              <span className="font-bold">{(() => { const t = Math.round((matchResult?.playerTime || 0) / 1000); return t < 60 ? `${t}s` : `${Math.floor(t/60)}m ${t%60}s`; })()}</span>
            </div>
            <div className="flex justify-between">
              <span>Opponent Time:</span>
              <span className="font-bold">{(() => { const t = Math.round((matchResult?.opponentTime || 0) / 1000); return t < 60 ? `${t}s` : `${Math.floor(t/60)}m ${t%60}s`; })()}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={onBack} variant="outline" className="flex-1">Home</Button>
            <Button onClick={() => matchService.offerRematch()} className="flex-1">Rematch</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => {
            matchService.abandonMatch();
            onBack();
          }}>Forfeit</Button>
          <h1 className="text-2xl font-bold">PvP Match</h1>
          <div className="text-sm">
            <div>Opponent: {opponentProgress.attempts} guesses</div>
            {opponentProgress.solved && <div className="text-green-600">Solved!</div>}
          </div>
        </div>

        <div className="flex justify-center">
          <Board
            guesses={currentBoard.guesses}
            currentGuess={currentGuess}
            maxGuesses={currentBoard.maxGuesses}
            evaluations={evaluations}
            isInvalidWord={currentGuess.length === 5 && !isValidWord(currentGuess)}
          />
        </div>

        {message && (
          <div className="text-center text-red-500 font-medium">{message}</div>
        )}

        <Keyboard onKey={handleKey} letterStates={letterStates} />
      </div>
    </div>
  );
}
