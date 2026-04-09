type TileStateString = 'CORRECT' | 'PRESENT' | 'ABSENT' | 'EMPTY';

const EMOJI_MAP: Record<TileStateString, string> = {
  CORRECT: '\u{1F7E9}', // green square
  PRESENT: '\u{1F7E8}', // yellow square
  ABSENT: '\u{2B1B}',   // black square
  EMPTY: '\u{2B1C}',    // white square
};

export function tileToEmoji(state: TileStateString): string {
  return EMOJI_MAP[state] || EMOJI_MAP.EMPTY;
}

/**
 * Generate emoji grid from a single board's evaluations.
 * evaluations: array of rows, each row is array of tile states
 */
export function generateEmojiGrid(evaluations: TileStateString[][]): string {
  return evaluations
    .map(row => row.map(tile => tileToEmoji(tile)).join(''))
    .join('\n');
}

/**
 * For multi-board modes, generate a compact summary.
 * Each board shows the guess number it was solved in, or X if failed.
 */
export function generateMultiBoardSummary(
  boards: { guesses: string[]; solution: string; status: string }[],
  evalFn: (solution: string, guess: string) => TileStateString[]
): string {
  const results = boards.map((board) => {
    if (board.status === 'WON') {
      return String(board.guesses.length);
    }
    return 'X';
  });

  // Arrange in grid: 2 columns for 4 boards, 4 columns for 8 boards
  const cols = boards.length <= 4 ? 2 : 4;
  const lines: string[] = [];
  for (let i = 0; i < results.length; i += cols) {
    lines.push(results.slice(i, i + cols).join(' '));
  }
  return lines.join('\n');
}

/**
 * Generate full share text for a game result.
 */
export function generateShareText(opts: {
  mode: string;
  won: boolean;
  guesses: number;
  maxGuesses: number;
  timeSeconds: number;
  emojiGrid?: string;
  boardSummary?: string;
  boardsSolved?: number;
  totalBoards?: number;
}): string {
  const { mode, won, guesses, maxGuesses, timeSeconds, emojiGrid, boardSummary, boardsSolved, totalBoards } = opts;
  const mins = Math.floor(timeSeconds / 60);
  const secs = timeSeconds % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

  const guessStr = won ? `${guesses}/${maxGuesses}` : `X/${maxGuesses}`;
  const boardStr = totalBoards && totalBoards > 1 ? ` ${boardsSolved ?? 0}/${totalBoards}` : '';

  let text = `SpellStrike ${mode} ${guessStr}${boardStr} \u{00B7} ${timeStr}\n`;

  if (boardSummary) {
    text += `\n${boardSummary}\n`;
  }

  if (emojiGrid) {
    text += `\n${emojiGrid}\n`;
  }

  return text.trim();
}

/**
 * Copy text to clipboard with fallback.
 */
export async function copyShareToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      return false;
    }
  }
}
